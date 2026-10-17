export function formatCoordinates(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
      !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
    throw new Error('The device returned invalid GPS coordinates.');
  }
  return `${Math.abs(latitude).toFixed(3)} ${latitude < 0 ? 'S' : 'N'}, ${Math.abs(longitude).toFixed(3)} ${longitude < 0 ? 'W' : 'E'}`;
}
