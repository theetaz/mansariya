package model

import "time"

type SimulationJob struct {
	ID                 string    `json:"id"`
	RouteID            string    `json:"route_id"`
	Name               string    `json:"name"`
	Status             string    `json:"status"`
	PingIntervalSec    int       `json:"ping_interval_sec"`
	DefaultSpeedMinKMH float64   `json:"default_speed_min_kmh"`
	DefaultSpeedMaxKMH float64   `json:"default_speed_max_kmh"`
	DefaultDwellMinSec int       `json:"default_dwell_min_sec"`
	DefaultDwellMaxSec int       `json:"default_dwell_max_sec"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
	VehicleCount       int       `json:"vehicle_count,omitempty"`
	DeviceCount        int       `json:"device_count,omitempty"`
	RouteName          string    `json:"route_name,omitempty"`
}

type SimulationVehicle struct {
	ID              string   `json:"id"`
	JobID           string   `json:"job_id"`
	VehicleID       string   `json:"vehicle_id"`
	PassengerCount  int      `json:"passenger_count"`
	SpeedMinKMH     *float64 `json:"speed_min_kmh,omitempty"`
	SpeedMaxKMH     *float64 `json:"speed_max_kmh,omitempty"`
	DwellMinSec     *int     `json:"dwell_min_sec,omitempty"`
	DwellMaxSec     *int     `json:"dwell_max_sec,omitempty"`
	StartStopID     *string  `json:"start_stop_id,omitempty"`
	StartLat        *float64 `json:"start_lat,omitempty"`
	StartLng        *float64 `json:"start_lng,omitempty"`
	PingIntervalSec *int     `json:"ping_interval_sec,omitempty"`
}

type SimulationJobInput struct {
	RouteID            string                   `json:"route_id"`
	Name               string                   `json:"name"`
	PingIntervalSec    int                      `json:"ping_interval_sec"`
	DefaultSpeedMinKMH float64                  `json:"default_speed_min_kmh"`
	DefaultSpeedMaxKMH float64                  `json:"default_speed_max_kmh"`
	DefaultDwellMinSec int                      `json:"default_dwell_min_sec"`
	DefaultDwellMaxSec int                      `json:"default_dwell_max_sec"`
	Vehicles           []SimulationVehicleInput `json:"vehicles"`
}

type SimulationVehicleInput struct {
	VehicleID       string   `json:"vehicle_id"`
	PassengerCount  int      `json:"passenger_count"`
	SpeedMinKMH     *float64 `json:"speed_min_kmh,omitempty"`
	SpeedMaxKMH     *float64 `json:"speed_max_kmh,omitempty"`
	DwellMinSec     *int     `json:"dwell_min_sec,omitempty"`
	DwellMaxSec     *int     `json:"dwell_max_sec,omitempty"`
	StartStopID     *string  `json:"start_stop_id,omitempty"`
	StartLat        *float64 `json:"start_lat,omitempty"`
	StartLng        *float64 `json:"start_lng,omitempty"`
	PingIntervalSec *int     `json:"ping_interval_sec,omitempty"`
}

type SimulationJobDetail struct {
	Job      SimulationJob       `json:"job"`
	Vehicles []SimulationVehicle `json:"vehicles"`
}

type SimulationActiveResponse struct {
	RunningJobs  int `json:"running_jobs"`
	TotalBuses   int `json:"total_buses"`
	TotalDevices int `json:"total_devices"`
}
