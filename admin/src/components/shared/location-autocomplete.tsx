import { useState, useRef, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { MapPinIcon, LoaderIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { geocodeSearch, type NominatimResult } from "@/lib/geo"

interface LocationAutocompleteProps {
  placeholder?: string
  value?: NominatimResult | null
  onSelect: (result: NominatimResult) => void
  onClear?: () => void
}

export function LocationAutocomplete({
  placeholder = "Search location...",
  value,
  onSelect,
  onClear,
}: LocationAutocompleteProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<NominatimResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 })

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync display value from controlled prop
  useEffect(() => {
    if (value) {
      const name = value.display_name.split(",")[0].trim()
      setQuery(name)
    }
  }, [value])

  const updateDropdownPosition = useCallback(() => {
    if (!inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    setDropdownPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    })
  }, [])

  // Reposition dropdown on scroll / resize
  useEffect(() => {
    if (!isOpen) return
    updateDropdownPosition()
    window.addEventListener("scroll", updateDropdownPosition, true)
    window.addEventListener("resize", updateDropdownPosition)
    return () => {
      window.removeEventListener("scroll", updateDropdownPosition, true)
      window.removeEventListener("resize", updateDropdownPosition)
    }
  }, [isOpen, updateDropdownPosition])

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        inputRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return
      }
      setIsOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  // Debounced search
  const handleChange = (text: string) => {
    setQuery(text)
    onClear?.()

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (text.length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    debounceRef.current = setTimeout(async () => {
      const data = await geocodeSearch(text)
      setResults(data)
      setIsOpen(data.length > 0)
      setIsLoading(false)
    }, 300)
  }

  const handleSelect = (result: NominatimResult) => {
    const name = result.display_name.split(",")[0].trim()
    setQuery(name)
    setIsOpen(false)
    onSelect(result)
  }

  return (
    <div className="relative">
      <div className="relative">
        <MapPinIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => {
            if (results.length > 0) {
              updateDropdownPosition()
              setIsOpen(true)
            }
          }}
          className="pl-8 pr-8"
        />
        {isLoading && (
          <LoaderIcon className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen &&
        results.length > 0 &&
        createPortal(
          <div
            ref={dropdownRef}
            className="z-[9999] overflow-hidden rounded-md border border-border bg-popover shadow-lg"
            style={{
              position: "fixed",
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
            }}
          >
            <ul className="max-h-60 overflow-y-auto py-1">
              {results.map((result) => {
                const name = result.display_name.split(",")[0].trim()
                return (
                  <li
                    key={result.place_id}
                    className="cursor-pointer px-3 py-2 hover:bg-accent transition-colors"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(result)}
                  >
                    <div className="font-medium text-sm text-foreground">
                      {name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {result.display_name}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground/70 mt-0.5">
                      {parseFloat(result.lat).toFixed(5)},{" "}
                      {parseFloat(result.lon).toFixed(5)}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>,
          document.body
        )}
    </div>
  )
}
