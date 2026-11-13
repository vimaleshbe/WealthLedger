import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import PageLoader from "../components/PageLoader";
import ErrorState from "../components/ErrorState";
import PageHeader from "../components/PageHeader";
import AssetForm from "../components/AssetForm";
import { useAsset, useCreateAsset, useUpdateAsset } from "../api/assets";
import { useToast } from "../components/ui/toast";
import type { AssetCreate } from "../types";

export default function AssetFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const assetId = id ? parseInt(id, 10) : undefined;
  const isEditing = !!assetId;
  const { success, error: showError } = useToast();

  const {
    data: asset,
    isLoading,
    error,
    refetch,
  } = useAsset(assetId);
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset(assetId ?? 0);

  const handleAssetSubmit = (data: AssetCreate) => {
    if (isEditing) {
      updateAsset.mutate(data, {
        onSuccess: () => {
          success("Asset updated successfully");
          navigate(`/assets/${assetId}`);
        },
        onError: (err: Error) =>
          showError(err.message || "Failed to update asset"),
      });
    } else {
      createAsset.mutate(data, {
        onSuccess: () => {
          success("Asset created successfully");
          navigate("/assets");
        },
        onError: (err: Error) =>
          showError(err.message || "Failed to create asset"),
      });
    }
  };

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState onRetry={refetch} />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit text-muted-foreground"
        onClick={() => navigate(isEditing ? `/assets/${assetId}` : "/assets")}
      >
        <ArrowLeft className="h-4 w-4" />
        {isEditing ? "Back to asset" : "Back to assets"}
      </Button>

      <PageHeader
        title={isEditing ? "Edit Asset" : "Add Asset"}
        description={
          isEditing
            ? "Update the asset details. Holdings are managed from the asset page."
            : "Choose a type, then add the details step by step."
        }
      />

      <Card>
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-lg">
            {isEditing ? "Asset details" : "New asset"}
          </CardTitle>
          <CardDescription>
            {isEditing
              ? "Changes apply to the asset record only — entries stay untouched."
              : "Search stocks and mutual funds, or enter details manually."}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5 sm:pt-6">
          <AssetForm
            initial={asset}
            onSubmit={handleAssetSubmit}
            onCancel={() =>
              navigate(isEditing ? `/assets/${assetId}` : "/assets")
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
