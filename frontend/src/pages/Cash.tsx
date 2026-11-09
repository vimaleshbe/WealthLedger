import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCashSummary } from "../api/cash";
import ErrorState from "../components/ErrorState";
import PageLoader from "../components/PageLoader";

export default function Cash() {
  const navigate = useNavigate();
  const { data, error, refetch } = useCashSummary();

  useEffect(() => {
    if (data) {
      navigate(`/assets/${data.asset_id}`, { replace: true });
    }
  }, [data, navigate]);

  if (error) return <ErrorState onRetry={refetch} />;

  return <PageLoader />;
}
