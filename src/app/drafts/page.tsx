import {DraftsScreen,type DraftsSearchParams} from "./drafts-screen";
import {migrationRequiredView} from "@/app/migration-required";

export const dynamic="force-dynamic";
export default async function DraftsPage({searchParams}:{searchParams:Promise<DraftsSearchParams>}){
  try{return await DraftsScreen({params:await searchParams});}catch(error){return migrationRequiredView(error);}
}
