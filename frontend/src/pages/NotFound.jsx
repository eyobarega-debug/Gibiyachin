import { Link } from "react-router-dom";
import { Button } from "../components/ui";
import Icon from "../components/Icon";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center animate-rise">
      <div className="glass mx-auto flex h-20 w-20 items-center justify-center rounded-2xl text-ink">
        <Icon name="compass" className="h-9 w-9" />
      </div>
      <h1 className="mt-6 text-2xl font-bold text-mirror">Page not found</h1>
      <p className="mt-2 text-sm text-slate">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <Button as={Link} to="/" className="mt-6">
        Back to home
      </Button>
    </div>
  );
}
