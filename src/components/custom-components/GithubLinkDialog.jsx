import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { listGithubRepos, linkGithubRepo, importGithubRepo } from '@/api';
import { useAuth } from '@/hooks/auth/AuthContext';

export default function GithubLinkDialog({ isOpen, onOpenChange, projectId, refetch }) {
  const { user } = useAuth();
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [branch, setBranch] = useState('');
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoError, setRepoError] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  // Fetch repos when dialog opens
  useEffect(() => {
    if (!isOpen || !user) return;

    async function fetchRepos() {
      setLoadingRepos(true);
      setRepoError('');
      try {
        const resp = await listGithubRepos(user.uid);
        setRepos(resp.data || []);
      } catch (err) {
        setRepoError(err.response?.data?.error || err.message);
        setRepos([]);
      } finally {
        setLoadingRepos(false);
      }
    }

    fetchRepos();
  }, [isOpen, user]);

  const handleRepoChange = (value) => {
    setSelectedRepo(value);
    const found = repos.find((r) => r.full_name === value);
    setBranch(found?.default_branch || '');
  };

  const handleLinkRepo = async () => {
    if (!user || !projectId || !selectedRepo) return;
    setRepoError('');
    setIsWorking(true);
    try {
      await linkGithubRepo(user.uid, projectId, { repo_full_name: selectedRepo, branch });
      const resp = await importGithubRepo(user.uid, projectId, {
        repo_full_name: selectedRepo,
        branch,
        max_files: 5000,
        max_bytes: 5242880,
      });
      const count = resp?.data?.files_imported;
      toast.success(
        `Repository linked and files imported${typeof count === 'number' ? ` (${count} files)` : ''}`
      );
      onOpenChange(false);
      if (refetch) await refetch();
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setRepoError(msg);
      toast.error(`Failed: ${msg}`);
    } finally {
      setIsWorking(false);
    }
  };

  const handleImportRepo = async () => {
    if (!user || !projectId) return;
    setRepoError('');
    setIsWorking(true);
    try {
      const resp = await importGithubRepo(user.uid, projectId, {
        repo_full_name: selectedRepo || undefined,
        branch: branch || undefined,
        max_files: 5000,
        max_bytes: 5242880,
      });
      const count = resp?.data?.files_imported;
      toast.success(
        `Files imported from GitHub${typeof count === 'number' ? ` (${count} files)` : ''}`
      );
      onOpenChange(false);
      if (refetch) await refetch();
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setRepoError(msg);
      toast.error(`Failed: ${msg}`);
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link your GitHub Repository</DialogTitle>
          <DialogDescription>
            Select a repository and optionally a branch to link or import files.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {loadingRepos ? (
            <div>Loading repositories...</div>
          ) : (
            <>
              <label className="text-sm">Repository</label>
              <select
                className="border rounded-md p-2 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                value={selectedRepo}
                onChange={(e) => handleRepoChange(e.target.value)}
              >
                <option value="">Select repo</option>
                {repos.map((r) => (
                  <option key={r.id} value={r.full_name}>
                    {r.full_name}
                  </option>
                ))}
              </select>
              {repoError && (
                <div className="text-destructive text-sm">{repoError}</div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleLinkRepo} disabled={!selectedRepo || isWorking}>
            {isWorking ? 'Working...' : 'Link'}
          </Button>
          <Button onClick={handleImportRepo} disabled={isWorking} variant="secondary">
            {isWorking ? 'Working...' : 'Import Files'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

