package store

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/masariya/backend/internal/model"
)

type SimulationStore struct {
	pool *pgxpool.Pool
}

func NewSimulationStore(pool *pgxpool.Pool) *SimulationStore {
	return &SimulationStore{pool: pool}
}

func (s *SimulationStore) Create(ctx context.Context, input model.SimulationJobInput) (*model.SimulationJob, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var job model.SimulationJob
	err = tx.QueryRow(ctx,
		`INSERT INTO simulation_jobs (route_id, name, ping_interval_sec, default_speed_min_kmh, default_speed_max_kmh, default_dwell_min_sec, default_dwell_max_sec)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id, route_id, name, status, ping_interval_sec, default_speed_min_kmh, default_speed_max_kmh, default_dwell_min_sec, default_dwell_max_sec, created_at, updated_at`,
		input.RouteID, input.Name, input.PingIntervalSec,
		input.DefaultSpeedMinKMH, input.DefaultSpeedMaxKMH,
		input.DefaultDwellMinSec, input.DefaultDwellMaxSec,
	).Scan(&job.ID, &job.RouteID, &job.Name, &job.Status,
		&job.PingIntervalSec, &job.DefaultSpeedMinKMH, &job.DefaultSpeedMaxKMH,
		&job.DefaultDwellMinSec, &job.DefaultDwellMaxSec,
		&job.CreatedAt, &job.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("insert simulation_jobs: %w", err)
	}

	for _, v := range input.Vehicles {
		_, err := tx.Exec(ctx,
			`INSERT INTO simulation_vehicles (job_id, vehicle_id, passenger_count, speed_min_kmh, speed_max_kmh, dwell_min_sec, dwell_max_sec, start_stop_id, start_lat, start_lng, ping_interval_sec)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
			job.ID, v.VehicleID, v.PassengerCount,
			v.SpeedMinKMH, v.SpeedMaxKMH,
			v.DwellMinSec, v.DwellMaxSec,
			v.StartStopID, v.StartLat, v.StartLng,
			v.PingIntervalSec,
		)
		if err != nil {
			return nil, fmt.Errorf("insert simulation_vehicles: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}
	return &job, nil
}

func (s *SimulationStore) Get(ctx context.Context, id string) (*model.SimulationJobDetail, error) {
	var job model.SimulationJob
	err := s.pool.QueryRow(ctx,
		`SELECT j.id, j.route_id, j.name, j.status, j.ping_interval_sec,
		        j.default_speed_min_kmh, j.default_speed_max_kmh,
		        j.default_dwell_min_sec, j.default_dwell_max_sec,
		        j.created_at, j.updated_at,
		        r.name_en
		 FROM simulation_jobs j
		 JOIN routes r ON r.id = j.route_id
		 WHERE j.id = $1`, id,
	).Scan(&job.ID, &job.RouteID, &job.Name, &job.Status,
		&job.PingIntervalSec, &job.DefaultSpeedMinKMH, &job.DefaultSpeedMaxKMH,
		&job.DefaultDwellMinSec, &job.DefaultDwellMaxSec,
		&job.CreatedAt, &job.UpdatedAt, &job.RouteName)
	if err != nil {
		return nil, fmt.Errorf("get simulation job: %w", err)
	}

	rows, err := s.pool.Query(ctx,
		`SELECT id, job_id, vehicle_id, passenger_count, speed_min_kmh, speed_max_kmh,
		        dwell_min_sec, dwell_max_sec, start_stop_id, start_lat, start_lng, ping_interval_sec
		 FROM simulation_vehicles WHERE job_id = $1`, id)
	if err != nil {
		return nil, fmt.Errorf("list simulation vehicles: %w", err)
	}
	defer rows.Close()

	var vehicles []model.SimulationVehicle
	for rows.Next() {
		var v model.SimulationVehicle
		if err := rows.Scan(&v.ID, &v.JobID, &v.VehicleID, &v.PassengerCount,
			&v.SpeedMinKMH, &v.SpeedMaxKMH,
			&v.DwellMinSec, &v.DwellMaxSec,
			&v.StartStopID, &v.StartLat, &v.StartLng,
			&v.PingIntervalSec); err != nil {
			return nil, fmt.Errorf("scan vehicle: %w", err)
		}
		vehicles = append(vehicles, v)
	}

	return &model.SimulationJobDetail{Job: job, Vehicles: vehicles}, nil
}

func (s *SimulationStore) List(ctx context.Context) ([]model.SimulationJob, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT j.id, j.route_id, j.name, j.status, j.ping_interval_sec,
		        j.default_speed_min_kmh, j.default_speed_max_kmh,
		        j.default_dwell_min_sec, j.default_dwell_max_sec,
		        j.created_at, j.updated_at,
		        r.name_en,
		        COUNT(v.id) AS vehicle_count,
		        COALESCE(SUM(v.passenger_count), 0) AS device_count
		 FROM simulation_jobs j
		 JOIN routes r ON r.id = j.route_id
		 LEFT JOIN simulation_vehicles v ON v.job_id = j.id
		 GROUP BY j.id, r.name_en
		 ORDER BY j.updated_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("list simulation jobs: %w", err)
	}
	defer rows.Close()

	var jobs []model.SimulationJob
	for rows.Next() {
		var j model.SimulationJob
		if err := rows.Scan(&j.ID, &j.RouteID, &j.Name, &j.Status,
			&j.PingIntervalSec, &j.DefaultSpeedMinKMH, &j.DefaultSpeedMaxKMH,
			&j.DefaultDwellMinSec, &j.DefaultDwellMaxSec,
			&j.CreatedAt, &j.UpdatedAt, &j.RouteName,
			&j.VehicleCount, &j.DeviceCount); err != nil {
			return nil, fmt.Errorf("scan job: %w", err)
		}
		jobs = append(jobs, j)
	}
	return jobs, nil
}

func (s *SimulationStore) ListFiltered(ctx context.Context, search, status, sortBy, sortDir string, limit, offset int) ([]model.SimulationJob, int, error) {
	if limit <= 0 {
		limit = 15
	}
	if limit > 100 {
		limit = 100
	}

	where := "WHERE 1=1"
	args := []interface{}{}
	n := 0

	if search != "" {
		n++
		where += fmt.Sprintf(" AND (j.name ILIKE $%d OR r.name_en ILIKE $%d)", n, n)
		args = append(args, "%"+search+"%")
	}
	if status != "" {
		n++
		where += fmt.Sprintf(" AND j.status = $%d", n)
		args = append(args, status)
	}

	var total int
	countQ := fmt.Sprintf(`SELECT COUNT(*) FROM simulation_jobs j JOIN routes r ON r.id = j.route_id %s`, where)
	if err := s.pool.QueryRow(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count simulations: %w", err)
	}

	sortCols := map[string]string{
		"name": "j.name", "status": "j.status", "created_at": "j.created_at", "updated_at": "j.updated_at",
	}
	sc := "j.updated_at"
	if col, ok := sortCols[sortBy]; ok {
		sc = col
	}
	sd := "DESC"
	if sortDir == "asc" {
		sd = "ASC"
	}

	n++
	args = append(args, limit)
	lp := fmt.Sprintf("$%d", n)
	n++
	args = append(args, offset)
	op := fmt.Sprintf("$%d", n)

	query := fmt.Sprintf(
		`SELECT j.id, j.route_id, j.name, j.status, j.ping_interval_sec,
		        j.default_speed_min_kmh, j.default_speed_max_kmh,
		        j.default_dwell_min_sec, j.default_dwell_max_sec,
		        j.created_at, j.updated_at,
		        r.name_en,
		        COUNT(v.id) AS vehicle_count,
		        COALESCE(SUM(v.passenger_count), 0) AS device_count
		 FROM simulation_jobs j
		 JOIN routes r ON r.id = j.route_id
		 LEFT JOIN simulation_vehicles v ON v.job_id = j.id
		 %s
		 GROUP BY j.id, r.name_en
		 ORDER BY %s %s LIMIT %s OFFSET %s`, where, sc, sd, lp, op)

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list simulations filtered: %w", err)
	}
	defer rows.Close()

	var jobs []model.SimulationJob
	for rows.Next() {
		var j model.SimulationJob
		if err := rows.Scan(&j.ID, &j.RouteID, &j.Name, &j.Status,
			&j.PingIntervalSec, &j.DefaultSpeedMinKMH, &j.DefaultSpeedMaxKMH,
			&j.DefaultDwellMinSec, &j.DefaultDwellMaxSec,
			&j.CreatedAt, &j.UpdatedAt, &j.RouteName,
			&j.VehicleCount, &j.DeviceCount); err != nil {
			return nil, 0, fmt.Errorf("scan simulation: %w", err)
		}
		jobs = append(jobs, j)
	}
	if jobs == nil {
		jobs = []model.SimulationJob{}
	}
	return jobs, total, nil
}

func (s *SimulationStore) Update(ctx context.Context, id string, input model.SimulationJobInput) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var status string
	if err := tx.QueryRow(ctx, `SELECT status FROM simulation_jobs WHERE id = $1`, id).Scan(&status); err != nil {
		return fmt.Errorf("get job status: %w", err)
	}
	if status != "draft" && status != "stopped" {
		return fmt.Errorf("cannot update job in %s state", status)
	}

	_, err = tx.Exec(ctx,
		`UPDATE simulation_jobs SET
		   route_id = $2, name = $3, ping_interval_sec = $4,
		   default_speed_min_kmh = $5, default_speed_max_kmh = $6,
		   default_dwell_min_sec = $7, default_dwell_max_sec = $8,
		   updated_at = NOW()
		 WHERE id = $1`,
		id, input.RouteID, input.Name, input.PingIntervalSec,
		input.DefaultSpeedMinKMH, input.DefaultSpeedMaxKMH,
		input.DefaultDwellMinSec, input.DefaultDwellMaxSec)
	if err != nil {
		return fmt.Errorf("update simulation_jobs: %w", err)
	}

	if _, err := tx.Exec(ctx, `DELETE FROM simulation_vehicles WHERE job_id = $1`, id); err != nil {
		return fmt.Errorf("delete old vehicles: %w", err)
	}
	for _, v := range input.Vehicles {
		_, err := tx.Exec(ctx,
			`INSERT INTO simulation_vehicles (job_id, vehicle_id, passenger_count, speed_min_kmh, speed_max_kmh, dwell_min_sec, dwell_max_sec, start_stop_id, start_lat, start_lng, ping_interval_sec)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
			id, v.VehicleID, v.PassengerCount,
			v.SpeedMinKMH, v.SpeedMaxKMH,
			v.DwellMinSec, v.DwellMaxSec,
			v.StartStopID, v.StartLat, v.StartLng,
			v.PingIntervalSec,
		)
		if err != nil {
			return fmt.Errorf("insert vehicle: %w", err)
		}
	}

	return tx.Commit(ctx)
}

func (s *SimulationStore) Delete(ctx context.Context, id string) error {
	var status string
	if err := s.pool.QueryRow(ctx, `SELECT status FROM simulation_jobs WHERE id = $1`, id).Scan(&status); err != nil {
		return fmt.Errorf("get job status: %w", err)
	}
	if status == "running" || status == "paused" {
		return fmt.Errorf("cannot delete job in %s state", status)
	}

	_, err := s.pool.Exec(ctx, `DELETE FROM simulation_jobs WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete simulation job: %w", err)
	}
	return nil
}

func (s *SimulationStore) SetStatus(ctx context.Context, id string, status string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE simulation_jobs SET status = $2, updated_at = NOW() WHERE id = $1`,
		id, status)
	if err != nil {
		return fmt.Errorf("set job status: %w", err)
	}
	return nil
}

func (s *SimulationStore) GetActiveStats(ctx context.Context) (*model.SimulationActiveResponse, error) {
	var resp model.SimulationActiveResponse
	err := s.pool.QueryRow(ctx,
		`SELECT COUNT(DISTINCT j.id), COALESCE(COUNT(v.id), 0), COALESCE(SUM(v.passenger_count), 0)
		 FROM simulation_jobs j
		 LEFT JOIN simulation_vehicles v ON v.job_id = j.id
		 WHERE j.status = 'running'`).Scan(&resp.RunningJobs, &resp.TotalBuses, &resp.TotalDevices)
	if err != nil {
		return nil, fmt.Errorf("get active stats: %w", err)
	}
	return &resp, nil
}

func (s *SimulationStore) ResetRunningToStopped(ctx context.Context) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE simulation_jobs SET status = 'stopped', updated_at = NOW() WHERE status IN ('running', 'paused')`)
	if err != nil {
		return fmt.Errorf("reset running simulations: %w", err)
	}
	return nil
}
