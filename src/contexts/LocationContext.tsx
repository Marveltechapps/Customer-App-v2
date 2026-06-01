import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storeService } from '../services/store/storeService';
import { useUser } from './UserContext';

const STORAGE_KEY = '@selorg_user_location';
const STORE_KEY = '@selorg_assigned_store';

// Location and assigned store are user-specific. Persist them under a key
// namespaced by the authenticated user id so data never leaks across accounts
// on a shared device. Logged-out browsing uses a separate "guest" bucket.
const GUEST_KEY = 'guest';
const locationKeyFor = (userKey: string) => `${STORAGE_KEY}:${userKey}`;
const storeKeyFor = (userKey: string) => `${STORE_KEY}:${userKey}`;

export interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
  area: string;
  city: string;
  granted: boolean;
}

export interface AssignedStore {
  id: string;
  name: string;
  code: string;
  distanceKm: number;
  avgPickPackTime: number;
}

export interface LocationContextValue {
  location: LocationData | null;
  setLocation: (loc: LocationData | null) => void;
  loading: boolean;
  requestLocationPermission: () => Promise<boolean>;
  getCurrentLocation: () => Promise<LocationData | null>;
  assignedStore: AssignedStore | null;
  serviceable: boolean;
}

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [location, setLocationState] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [assignedStore, setAssignedStore] = useState<AssignedStore | null>(null);
  const [serviceable, setServiceable] = useState(true);
  const { user, isRestoring, userKey } = useUser();

  // Active storage bucket: the authenticated user's primary key (phone), or "guest".
  // userKey is derived in UserContext to ensure consistency across the app.
  // Held in a ref so persistence callbacks always read/write the current
  // user's bucket without being recreated on every user change.
  const userKeyRef = useRef(userKey);
  userKeyRef.current = userKey;

  // Reset in-memory state and reload the active user's saved location whenever
  // the authenticated user changes (login, logout, or account switch). Waits
  // for the session restore to finish so we don't briefly load the guest bucket.
  useEffect(() => {
    if (isRestoring) return;
    let active = true;
    setLocationState(null);
    setAssignedStore(null);
    setServiceable(true);
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(locationKeyFor(userKey));
        if (active && stored) {
          setLocationState(JSON.parse(stored));
        }
        const storedStore = await AsyncStorage.getItem(storeKeyFor(userKey));
        if (active && storedStore) {
          setAssignedStore(JSON.parse(storedStore));
        }
      } catch {
        // storage read failed — start fresh
      }
    })();
    return () => {
      active = false;
    };
  }, [userKey, isRestoring]);

  const assignNearestStore = useCallback(async (lat: number, lng: number) => {
    try {
      const result = await storeService.assignStore(lat, lng);
      if (result.serviceable && result.store) {
        setAssignedStore(result.store);
        setServiceable(true);
        await AsyncStorage.setItem(storeKeyFor(userKeyRef.current), JSON.stringify(result.store));
      } else {
        setServiceable(false);
        setAssignedStore(null);
        await AsyncStorage.removeItem(storeKeyFor(userKeyRef.current));
      }
    } catch {
      setServiceable(false);
    }
  }, []);

  const setLocation = useCallback(async (loc: LocationData | null) => {
    setLocationState(loc);
    try {
      if (loc) {
        await AsyncStorage.setItem(locationKeyFor(userKeyRef.current), JSON.stringify(loc));
        assignNearestStore(loc.latitude, loc.longitude);
      } else {
        await AsyncStorage.removeItem(locationKeyFor(userKeyRef.current));
        setAssignedStore(null);
        await AsyncStorage.removeItem(storeKeyFor(userKeyRef.current));
      }
    } catch {
      // storage write failed — non-critical
    }
  }, [assignNearestStore]);

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }, []);

  const getCurrentLocation = useCallback(async (): Promise<LocationData | null> => {
    setLoading(true);
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = position.coords;

      let address = '';
      let area = '';
      let city = '';

      try {
        const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geocoded.length > 0) {
          const place = geocoded[0];
          const parts: string[] = [];
          if (place.name) parts.push(place.name);
          if (place.street) parts.push(place.street);
          if (place.district) parts.push(place.district);
          if (place.city) parts.push(place.city);
          if (place.region) parts.push(place.region);
          address = parts.join(', ');
          area = place.district || place.subregion || place.name || '';
          city = place.city || place.region || '';
        }
      } catch {
        address = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      }

      const locationData: LocationData = {
        latitude,
        longitude,
        address,
        area,
        city,
        granted: true,
      };

      await setLocation(locationData);
      return locationData;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [setLocation]);

  return (
    <LocationContext.Provider
      value={{ location, setLocation, loading, requestLocationPermission, getCurrentLocation, assignedStore, serviceable }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used within LocationProvider');
  return ctx;
}

export default LocationContext;
