/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { findNearestAirport, type NearestAirportResult } from '@/lib/geo-utils';

// Dynamic import for Google Maps — the package is installed via pnpm at build time
let LoadScript: any = null;
let StandaloneSearchBox: any = null;
let GoogleMap: any = null;
let MarkerF: any = null;

if (typeof window !== 'undefined') {
  // Client-side only — will be resolved by webpack/turbopack at build time
}

const LIBRARIES = ['places'] as const;

const DARK_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a9a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a3e' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6a6a7a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1a2b' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#222238' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6a6a7a' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#222238' }] },
];

const MAP_OPTIONS = {
  disableDefaultUI: true,
  zoomControl: true,
  styles: DARK_MAP_STYLES,
  backgroundColor: '#1a1a2e',
};

export interface LocationData {
  address: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  distanceToAirportKm: number;
  nearestAirport: string;
}

interface Props {
  value: LocationData;
  onChange: (loc: LocationData) => void;
  error?: string;
}

/** Extract city and state from Google Places address_components */
function extractCityState(components: any[]): { city: string; state: string } {
  let city = '';
  let state = '';

  for (const comp of components) {
    if (comp.types.includes('locality')) {
      city = comp.long_name;
    }
    if (comp.types.includes('administrative_area_level_1')) {
      state = comp.long_name;
    }
    if (!city && comp.types.includes('sublocality_level_1')) {
      city = comp.long_name;
    }
    if (!city && comp.types.includes('administrative_area_level_2')) {
      city = comp.long_name;
    }
  }

  return { city, state };
}

export default function GoogleMapsLocationInput({ value, onChange, error }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const searchBoxRef = useRef<any>(null);
  const [airportInfo, setAirportInfo] = useState<NearestAirportResult | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: value.latitude || 20.5937, lng: value.longitude || 78.9629 });
  const [mapZoom, setMapZoom] = useState(value.latitude ? 14 : 5);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [MapsComponents, setMapsComponents] = useState<any>(null);

  // Dynamically import Google Maps components on client
  useEffect(() => {
    // @ts-ignore — package installed at build time via pnpm
    import('@react-google-maps/api').then((mod: any) => {
      setMapsComponents({
        LoadScript: mod.LoadScript,
        StandaloneSearchBox: mod.StandaloneSearchBox,
        GoogleMap: mod.GoogleMap,
        MarkerF: mod.MarkerF,
      });
    }).catch(() => {
      // Package not available — graceful fallback
    });
  }, []);

  // Update airport info when coordinates change
  useEffect(() => {
    if (value.latitude && value.longitude) {
      const result = findNearestAirport(value.latitude, value.longitude);
      setAirportInfo(result);
    }
  }, [value.latitude, value.longitude]);

  const onPlacesChanged = useCallback(() => {
    const places = searchBoxRef.current?.getPlaces?.();
    if (!places || places.length === 0) return;

    const place = places[0];
    if (!place.geometry?.location) return;

    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    const { city, state } = extractCityState(place.address_components || []);
    const airport = findNearestAirport(lat, lng);

    const newLocation: LocationData = {
      address: place.formatted_address || '',
      latitude: lat,
      longitude: lng,
      city: city || value.city,
      state: state || value.state,
      distanceToAirportKm: airport.distanceKm,
      nearestAirport: `${airport.airportName} (${airport.airportCode})`,
    };

    onChange(newLocation);
    setMapCenter({ lat, lng });
    setMapZoom(14);
    setAirportInfo(airport);
  }, [onChange, value.city, value.state]);

  // Fallback: no API key or package not loaded
  if (!apiKey || !MapsComponents) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-surface-200 mb-1.5">
          Property Address
        </label>
        <input
          type="text"
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          placeholder="Enter full property address (e.g. Taj Falaknuma Palace, Hyderabad)"
          className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-3 text-white placeholder:text-surface-500 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none transition-all"
        />
        {!apiKey && (
          <p className="text-xs text-amber-400/70">
            Google Maps not configured — enter address manually. Location will be approximated.
          </p>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  const { LoadScript: LS, StandaloneSearchBox: SSB, GoogleMap: GM, MarkerF: MF } = MapsComponents;

  return (
    <LS googleMapsApiKey={apiKey} libraries={LIBRARIES as any}>
      <div className="space-y-3">
        {/* Address Search */}
        <div>
          <label className="block text-sm font-medium text-surface-200 mb-1.5">
            Property Address
          </label>
          <SSB
            onLoad={(ref: any) => { searchBoxRef.current = ref; }}
            onPlacesChanged={onPlacesChanged}
          >
            <input
              type="text"
              defaultValue={value.address}
              placeholder="Start typing address — e.g. Taj Falaknuma Palace, Hyderabad"
              className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-3 text-white placeholder:text-surface-500 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none transition-all"
            />
          </SSB>
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </div>

        {/* Map Preview */}
        {value.latitude !== 0 && value.longitude !== 0 && (
          <div className="rounded-xl overflow-hidden border border-surface-600">
            <GM
              mapContainerStyle={{ width: '100%', height: '220px' }}
              center={mapCenter}
              zoom={mapZoom}
              options={MAP_OPTIONS}
            >
              <MF position={{ lat: value.latitude, lng: value.longitude }} />
            </GM>
          </div>
        )}

        {/* Airport Distance Badge */}
        {airportInfo && value.latitude !== 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-surface-800/50 border border-surface-700 rounded-lg">
            <span className="text-lg">✈️</span>
            <span className="text-sm text-surface-300">
              <span className="font-medium text-white">{airportInfo.distanceKm} km</span> from{' '}
              {airportInfo.airportName} ({airportInfo.airportCode})
            </span>
          </div>
        )}
      </div>
    </LS>
  );
}
