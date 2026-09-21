import {DraftsScreen,type DraftsSearchParams} from "./drafts-screen";

export const dynamic="force-dynamic";
export default async function DraftsPage({searchParams}:{searchParams:Promise<DraftsSearchParams>}){
  return <DraftsScreen params={await searchParams}/>;
}
