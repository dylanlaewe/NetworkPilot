import {DraftsScreen,type DraftsSearchParams} from "../drafts-screen";

export const dynamic="force-dynamic";
export default async function DraftReviewPage({searchParams}:{searchParams:Promise<DraftsSearchParams>}){
  return <DraftsScreen params={await searchParams} reviewMode/>;
}
