import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useUploadWithPolling(docType: string, bidderId: string = 'user-bidder-001') {
  const queryClient = useQueryClient();
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [lastUploadedFile, setLastUploadedFile] = useState<{
    name: string;
    size: number;
    sha256?: string;
  } | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('docType', docType);
      formData.append('bidderId', bidderId);

      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/uploads', {
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
      setActiveUploadId(uploadId);
      setLastUploadedFile({
        name: variables.name,
        size: variables.size,
        sha256: result.data.sha256,
      });
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
      const res = await fetch(`/api/uploads/${activeUploadId}/verification-status`);
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
