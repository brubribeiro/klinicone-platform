import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { patientsApi } from '../../api/patients';
import type { MapViewDef } from './applicationMapModel';

/** Foto da paciente usada no mapa (vista `photo` e textura do 3D), servida pela API. */
export function useMapPhoto(patientId: string | undefined, photoId: string | undefined) {
  const { data: blob, isError } = useQuery({
    queryKey: ['patient-photo-file', patientId, photoId],
    queryFn: () => patientsApi.photoFile(patientId!, photoId!),
    enabled: !!patientId && !!photoId,
    staleTime: Infinity,
  });
  const [image, setImage] = useState<MapViewDef | null>(null);

  useEffect(() => {
    setImage(null);
    if (!blob) return;
    const src = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () =>
      setImage({
        label: 'Foto da paciente',
        src,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    img.src = src;
    return () => URL.revokeObjectURL(src);
  }, [blob]);

  return { image, isError, isLoading: !!photoId && !image && !isError };
}
