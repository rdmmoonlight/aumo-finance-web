import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container text-center mt-5 py-5">
      <div className="card shadow-sm border-0 rounded-4 max-w-md mx-auto p-4">
        <i className="bi bi-exclamation-triangle text-danger display-4 mb-3"></i>
        <h3 className="fw-bold">Page Not Found</h3>
        <p className="text-secondary">The page you requested could not be found.</p>
        <div className="mt-3">
          <Link href="/" className="btn btn-secondary px-4 fw-semibold">Return to Home</Link>
        </div>
      </div>
    </div>
  );
}
