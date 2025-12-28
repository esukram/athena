import { trpc } from '../utils/trpc';

export const HelloWorld = () => {
  const hello = trpc.hello.useQuery({ text: 'Client' });

  if (hello.isLoading) return <div>Loading...</div>;
  if (hello.error) return <div>Error: {hello.error.message}</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>tRPC + React + Turborepo</h1>
      <pre>{JSON.stringify(hello.data, null, 2)}</pre>
    </div>
  );
};
