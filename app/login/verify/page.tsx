import VerifyForm from "./verify-form";
type Params = { token_hash?: string; type?: string; next?: string };
export default async function Verify({ searchParams }: { searchParams: Promise<Params> }) { const params = await searchParams; return <VerifyForm tokenHash={params.token_hash} type={params.type} requestedNext={params.next} />; }
