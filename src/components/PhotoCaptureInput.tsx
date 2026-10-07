import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Camera, Upload, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";

// A required passport-photo field that lets the person either upload an
// existing image file or capture one live from the device's camera — used
// wherever a pupil (or staff member) must have a photo on file before the
// form can be submitted (see admission-officer.enroll.tsx). Deliberately
// self-contained (no external camera library): getUserMedia + a canvas
// snapshot is all browsers need for a single still photo.

interface PhotoCaptureInputProps {
  label?: string;
  value: string | null; // data URL (base64), or null if nothing captured yet
  onChange: (value: string | null) => void;
  required?: boolean;
  disabled?: boolean;
}

export function PhotoCaptureInput({ label = "Passport photograph", value, onChange, required, disabled }: PhotoCaptureInputProps) {
  const [mode, setMode] = useState<"idle" | "camera">("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Always release the camera when it's no longer needed — leaving the
  // stream open after the tab/component is gone keeps the camera's
  // hardware light on and can block other apps from using it.
  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      setStream(s);
      setMode("camera");
      // The <video> element only mounts once mode === "camera" re-renders,
      // so attach the stream on the next tick.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      toast.error("Couldn't access the camera. Check camera permissions, or upload a photo file instead.");
    }
  };

  const stopCamera = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setMode("idle");
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    // Most webcams/front cameras are wide (landscape) by default, so a raw
    // capture is usually too wide to pass the passport-shape check below.
    // Crop to a centered square first — this is what makes "point camera at
    // your face, hit capture" reliably produce a passport-shaped photo
    // without asking the person to rotate their device.
    const side = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - side) / 2;
    const sy = (video.videoHeight - side) / 2;
    const scale = Math.min(1, 900 / side);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(side * scale);
    canvas.height = Math.round(side * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, sx, sy, side, side, 0, 0, canvas.width, canvas.height);
    if (!isPassportShaped(canvas.width, canvas.height)) {
      toast.error("That capture was too small to use. Move closer and try again.");
      return;
    }
    onChange(canvas.toDataURL("image/jpeg", 0.85));
    stopCamera();
  };

  // A passport photo is a close, head-and-shoulders crop — roughly square to
  // gently portrait. This rejects the two most common wrong uploads: a wide
  // landscape scene/group photo (ratio well above 1), and a full-body phone
  // photo shot in portrait, which is far taller than it is wide (typically
  // ~0.56 for a 9:16 frame). It can't verify there's actually a face in the
  // shot — that needs real image recognition — but shape alone catches the
  // overwhelming majority of "wrong photo" submissions without extra cost.
  const PASSPORT_MIN_RATIO = 0.6; // tallest acceptable (gently portrait)
  const PASSPORT_MAX_RATIO = 1.2; // widest acceptable (near square)
  const PASSPORT_MIN_DIMENSION = 150; // px, rejects tiny/low-quality images

  const isPassportShaped = (width: number, height: number) => {
    if (width < PASSPORT_MIN_DIMENSION || height < PASSPORT_MIN_DIMENSION) return false;
    const ratio = width / height;
    return ratio >= PASSPORT_MIN_RATIO && ratio <= PASSPORT_MAX_RATIO;
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    // Downscale before storing: a raw phone photo can be several MB, which
    // becomes ~1.4x larger as base64 and can exceed the server request limit.
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        if (!isPassportShaped(img.width, img.height)) {
          toast.error(
            "That doesn't look like a passport photo — it's too wide or too tall. Upload a close, head-and-shoulders photo, not a full-body or group picture.",
          );
          return;
        }
        const MAX = 900;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { onChange(reader.result as string); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        onChange(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => toast.error("That image couldn't be read. Try a different file.");
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const clear = () => {
    onChange(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>

      {value && mode === "idle" && (
        <div className="flex items-center gap-3">
          <img src={value} alt="Passport preview" className="h-24 w-24 rounded-md border border-border object-cover" />
          <div className="flex flex-col gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={disabled}>
              <RotateCcw className="mr-2 h-4 w-4" /> Replace
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={clear} disabled={disabled}>
              <X className="mr-2 h-4 w-4" /> Remove
            </Button>
          </div>
        </div>
      )}

      {!value && mode === "idle" && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={disabled}>
            <Upload className="mr-2 h-4 w-4" /> Upload a photo
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={startCamera} disabled={disabled}>
            <Camera className="mr-2 h-4 w-4" /> Use camera
          </Button>
        </div>
      )}

      {mode === "camera" && (
        <div className="space-y-2">
          <video ref={videoRef} className="h-56 w-full max-w-xs rounded-md border border-border bg-black object-cover" muted playsInline />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={capture}>
              <Camera className="mr-2 h-4 w-4" /> Capture
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={stopCamera}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
