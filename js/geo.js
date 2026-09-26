// Position GPS du telephone
export const hasGeo = 'geolocation' in navigator;

const toHere = p => ({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, t: Date.now() });

// Suivi continu (une position de moins de 5 s suffit)
export function watchPosition(onFix, onError) {
  navigator.geolocation.watchPosition(p => onFix(toHere(p)), onError,
                                      { enableHighAccuracy: true, maximumAge: 5000 });
}

// Position fraiche, sans cache, a la demande
export function freshPosition(onFix, onError) {
  navigator.geolocation.getCurrentPosition(p => onFix(toHere(p)), onError,
                                           { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
}
