/**
 * Lee un archivo como texto UTF-8 con FileReader (compatible con Safari viejos,
 * donde Blob.text() no existe). Los bytes que no son UTF-8 válido quedan como
 * U+FFFD, que la validación detecta para avisar "guardalo como CSV UTF-8".
 */
export function readFileAsText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo'));
    reader.readAsText(file, 'utf-8');
  });
}
