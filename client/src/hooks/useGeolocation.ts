import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface GeolocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface GeolocationState {
  coordinates: GeolocationCoordinates | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to get current geolocation with automatic permission handling
 * Returns coordinates, loading state, and error
 */
export function useGeolocation(autoCapture: boolean = false) {
  const [state, setState] = useState<GeolocationState>({
    coordinates: null,
    loading: false,
    error: null,
  });

  const captureLocation = () => {
    if (!navigator.geolocation) {
      const error = 'Geolocation is not supported by your browser';
      setState({ coordinates: null, loading: false, error });
      toast.error(error);
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates: GeolocationCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setState({ coordinates, loading: false, error: null });
        toast.success(`Location captured (±${Math.round(coordinates.accuracy)}m accuracy)`);
      },
      (error) => {
        let errorMessage = 'Failed to get location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }
        setState({ coordinates: null, loading: false, error: errorMessage });
        toast.error(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  useEffect(() => {
    if (autoCapture) {
      captureLocation();
    }
  }, [autoCapture]);

  return {
    ...state,
    captureLocation,
    hasLocation: state.coordinates !== null,
  };
}

/**
 * Check if geolocation is available
 */
export function isGeolocationAvailable(): boolean {
  return 'geolocation' in navigator;
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}
