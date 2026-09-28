import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE, getStoredToken } from '@/lib/apiClient';

export function useUploadWithPolling(docType: string, bidderId: string = 'user-bidder-001') {
  const queryClient = useQueryClient();
  const [uploadsMap, setUploadsMap] = useState<Record<string, {
    activeUploadId: string | null;
    lastUploadedFile: {
      name: string;
      size: number;
      sha256?: string;
    } | null;
  }>>({});

  const currentUpload = uploadsMap[docType] || { activeUploadId: null, lastUploadedFile: null };
  const activeUploadId = currentUpload.activeUploadId;
  const lastUploadedFile = currentUpload.lastUploadedFile;

  const setActiveUploadId = (id: string | null) => {
    setUploadsMap((prev) => ({
      ...prev,
      [docType]: {
        ...(prev[docType] || { lastUploadedFile: null }),
        activeUploadId: id,
      },
    }));
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('docType', docType);
      formData.append('bidderId', bidderId);

      const token = getStoredToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/uploads`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message ?? err.message ?? 'Upload failed');
      }
      return res.json();
    },
    onSuccess: (result, variables) => {
      const uploadId = result.data.uploadId;
      setUploadsMap((prev) => ({
        ...prev,
        [docType]: {
          activeUploadId: uploadId,
          lastUploadedFile: {
            name: variables.name,
            size: variables.size,
            sha256: result.data.sha256,
          },
        },
      }));
      // Immediately prime query cache with initial pipeline state from upload response
      if (result.data.pipeline) {
        queryClient.setQueryData(['uploadStatus', uploadId], {
          data: result.data.pipeline,
          error: null,
        });
      }
    },
  });

  const statusQuery = useQuery({
    queryKey: ['uploadStatus', activeUploadId],
    queryFn: async () => {
      if (!activeUploadId) return null;
      const res = await fetch(`${API_BASE}/uploads/${activeUploadId}/verification-status`);
      if (!res.ok) {
        throw new Error('Failed to fetch verification status');
      }
      return res.json();
    },
    enabled: !!activeUploadId,
    refetchInterval: (query) => {
      const status = query.state.data?.data?.overallStatus;
      const terminal = ['verified', 'warning', 'failed', 'human_review'];
      return terminal.includes(status) ? false : 1000;
    },
  });

  return { uploadMutation, statusQuery, activeUploadId, lastUploadedFile, setActiveUploadId };
}
