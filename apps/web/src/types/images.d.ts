// Tipos de las imágenes importadas (.webp, .png…) para next/image. next-env.d.ts los incluye, pero
// se genera en el build y no está en el repo: sin esto, el typecheck de CI (antes del build) falla.
/// <reference types="next/image-types/global" />
