import { useParams } from "wouter";
import StoryEditor from "@/components/stories/StoryEditor";

export default function StoriesPage() {
  const { campaignId } = useParams();

  return (
    <div className="min-h-screen">
      <div className="max-w-full mx-auto">
        <StoryEditor campaignId={campaignId} />
      </div>
    </div>
  );
}