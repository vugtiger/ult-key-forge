import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { getRawLoaderUrl } from "@/lib/loader-url";

const LoaderRedirect = () => {
  const { slug } = useParams<{ slug: string }>();

  useEffect(() => {
    if (!slug) return;
    window.location.replace(getRawLoaderUrl(encodeURIComponent(slug)));
  }, [slug]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      <p className="text-sm text-muted-foreground">
        {slug ? "Opening protected script…" : "Invalid script link."}
      </p>
    </main>
  );
};

export default LoaderRedirect;