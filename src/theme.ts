export const colors = {
  bg: '#F6F1E5',
  bgTop: '#EAF0DE',
  surface: '#FFFFFF',
  ink: '#1C2B22',
  muted: '#6E7B72',
  line: '#DEDACB',
  accent: '#2F6B4F',
  accentDeep: '#1F4D38',
  accentSoft: '#DCEADF',
  live: '#E39B2D',
  liveSoft: '#FBEBD3',
  danger: '#B4483B',
};

const avatarPalette = ['#4F7C63', '#8A6A4A', '#5C7FA3', '#A0594D', '#7A7F3E', '#6B5B95', '#3E8A8A', '#B07A2A'];

export function avatarColor(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return avatarPalette[Math.abs(h) % avatarPalette.length];
}
