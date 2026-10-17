type ModelAsset = {
  downloadAsync(): Promise<{ localUri: string | null }>;
};

export async function localModelSource(asset: ModelAsset): Promise<{ url: string }> {
  const { localUri } = await asset.downloadAsync();
  if (!localUri?.startsWith('file://')) {
    throw new Error('BirdNET model could not be loaded from a local file.');
  }
  return { url: localUri };
}
