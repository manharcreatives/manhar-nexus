import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { ImageCropDialog } from './ImageCropDialog';
import { validateImageFile, type ImageKind, type ImageProblem } from './imageTools';
import { ACCEPT_ATTR } from './imageTools';

export interface ImagePickerOptions {
  kind: ImageKind;
  /** Title of the crop dialog. */
  title: string;
  /** Accessible name of the (visually hidden) file input. */
  inputLabel: string;
  /** Cropped, re-encoded image ready to upload. */
  onBlob: (blob: Blob, source: File) => void;
  /** File rejected before any decoding (wrong type / empty / too large). */
  onProblem: (problem: ImageProblem, file: File) => void;
  disabled?: boolean;
}

/**
 * File picker + drag/drop + crop step. Render `input` and `dialog` once, wire `dropProps`
 * onto the drop target and call `open()` from a real button (keyboard accessible).
 */
export function useImagePicker({ kind, title, inputLabel, onBlob, onProblem, disabled }: ImagePickerOptions) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  function accept(files: FileList | File[] | null | undefined) {
    const f = files?.[0];
    if (!f || disabled) return;
    const problem = validateImageFile(f);
    if (problem) onProblem(problem, f);
    else setFile(f);
  }

  const input: ReactNode = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT_ATTR}
      aria-label={inputLabel}
      tabIndex={-1}
      className="sr-only"
      disabled={disabled}
      onChange={(e) => {
        accept(e.target.files);
        e.target.value = ''; // allow picking the same file again
      }}
    />
  );

  const dialog: ReactNode = file ? (
    <ImageCropDialog
      file={file}
      kind={kind}
      title={title}
      onCancel={() => setFile(null)}
      onConfirm={(blob) => {
        const src = file;
        setFile(null);
        onBlob(blob, src);
      }}
    />
  ) : null;

  const dropProps = {
    onDragOver: (e: DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      accept(e.dataTransfer?.files);
    },
  };

  return { open: () => inputRef.current?.click(), input, dialog, dropProps, dragging, accept };
}
