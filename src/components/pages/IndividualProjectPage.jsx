import { columns } from '../custom-components/individual-project-table/columns';
import IndividualProjectTable from '../custom-components/individual-project-table/IndividualProjectTable';
import { useParams, useLocation, useNavigate } from 'react-router';
import { useGetSubmissions } from '@/hooks/useGetSubmissions';
import { useProject } from '../../hooks/project/ProjectContext';
import { useAuth } from '@/hooks/auth/AuthContext';
import { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useGetFileStructure } from '@/hooks/useGetFileStructure';
import ResizableCodeEditor from '../custom-components/code-editor/ResizableCodeEditor';
import GenerateSecurityReviewSheet from '../custom-components/GenerateSecurityReviewSheet';
import GithubLinkDialog from '../custom-components/GithubLinkDialog';
import { toast } from 'sonner';

export default function IndividualProjectPage() {
  const { projectId } = useParams();
  const { fetchProjectById } = useProject();
  const { user } = useAuth();
  const {
    tree,
    loading: treeLoading,
    refetch: refetchFileTree,
  } = useGetFileStructure(projectId);
  const {
    submissions,
    error: submissionsError,
    loading: submissionsLoading,
    refetch: refetchSubmissions,
  } = useGetSubmissions(projectId);

  const [securityReview, setSecurityReview] = useState('');
  const location = useLocation();
  const projectName = location.state?.projectName;
  const [isSecReviewLoading, setIsSecReviewLoading] = useState(false);

  // GitHub dialog open state
  const [isRepoDialogOpen, setIsRepoDialogOpen] = useState(false);

  // Fetch project data on mount
  useEffect(() => {
    if (!projectId) return;

    async function fetchData() {
      try {
        const projectData = await fetchProjectById({ projectId });
        console.log('Project data:', projectData);
      } catch (err) {
        console.error(
          `Failed to load project: ${err.response?.data?.error || err.message}`
        );
        toast.error(`Failed to load project: ${err.response?.data?.error || err.message}`);
      }
    }

    fetchData();
  }, [projectId, fetchProjectById]);

  const { submissions, error: submissionsError, refetch } = useGetSubmissions(projectId);

  const hasGithubToken = useMemo(() => Boolean(localStorage.getItem('github_access_token')), []);

  // Console logging for debugging
  console.log(`[PROJECT PAGE] Submissions count: ${submissions?.length || 0}`, submissions);

  return (
    <main className="w-full min-h-screen flex flex-col p-5">
      <h1 className="font-bold text-4xl text-secure-blue">{`Project: ${projectName}`}</h1>

      <div className="my-3 flex gap-2">
        {hasGithubToken && (
          <Button onClick={() => setIsRepoDialogOpen(true)} className="bg-secure-orange">
            Link GitHub Repository
          </Button>
        )}
        <GenerateSecurityReviewSheet
          submissions={submissions}
          projectId={projectId}
          setSecurityReview={setSecurityReview}
          projectName={projectName}
          setIsSecReviewLoading={setIsSecReviewLoading}
        />
      </div>

      {submissionsError && (
        <div className="text-destructive text-sm mt-2">{submissionsError}</div>
      )}

      {/* GitHub linking dialog */}
      <GithubLinkDialog
        isOpen={isRepoDialogOpen}
        onOpenChange={setIsRepoDialogOpen}
        projectId={projectId}
        refetch={refetch}
      />

      {/* Code editor */}
      <ResizableCodeEditor
        tree={tree}
        refetchFileTree={refetchFileTree}
        securityReview={securityReview}
        openFiles={[]}
        setOpenFiles={() => {}}
        activeFile={null}
        setActiveFile={() => {}}
        isSecReviewLoading={isSecReviewLoading}
      />

      {/* Submissions table */}
      <IndividualProjectTable columns={columns} data={submissions} />
    </main>
  );
}
