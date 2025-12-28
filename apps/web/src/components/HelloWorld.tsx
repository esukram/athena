import { trpc } from '../utils/trpc';

export const HelloWorld = () => {
  const hello = trpc.hello.hello.useQuery({ text: 'Client' });

  if (hello.isLoading)
    return <div className="p-5 text-on-surface">Loading...</div>;
  if (hello.error)
    return <div className="p-5 text-error">Error: {hello.error.message}</div>;

  return (
    <div className="p-5 font-sans">
      <h1 className="text-3xl font-bold mb-4 text-on-surface">
        tRPC + React + Turborepo
      </h1>
      <img src="/assets/logo.png" alt="Logo" className="mb-4" />
      <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-sm">
        {JSON.stringify(hello.data, null, 2)}
      </pre>
    </div>
  );
};
