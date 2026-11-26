import { Directory, File, Paths } from 'expo-file-system';

function directory(owner: string) {
  if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(owner)) throw new Error('Pemilik struk tidak valid.');
  return new Directory(Paths.document, 'receipts', owner);
}

export async function keepPickedReceipt(uri: string, owner: string) {
  const dir = directory(owner);
  dir.create({ intermediates: true, idempotent: true });
  const ext = uri.match(/\.(png|webp|heic|pdf)$/i)?.[1].toLowerCase() || 'jpg';
  const target = new File(dir, `${crypto.randomUUID()}.${ext}`);
  await new File(uri).copy(target);
  return target.uri;
}

export async function readReceipt(uri: string, owner: string) {
  const file = new File(uri);
  if (file.parentDirectory.uri !== directory(owner).uri || !/^[a-f0-9-]{36}\.(jpg|png|webp|heic|pdf)$/.test(file.name)) {
    throw new Error('Pilih ulang berkas struk dari galeri.');
  }
  return file.base64();
}

export function deleteReceiptFiles(owner: string) {
  const dir = directory(owner);
  if (dir.exists) dir.delete();
}
