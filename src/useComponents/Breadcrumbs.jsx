import { useLocation, Link } from 'react-router-dom';

const Breadcrumbs = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  return (
    <nav aria-label="Breadcrumb">
      <ol style={{ display: 'flex', listStyle: 'none', gap: '8px' }}>
        <li>
          <Link to="/">Home</Link>
        </li>
        {pathnames.map((value, index) => {
          const to = `/${pathnames.slice(0, index + 1).join('/')}`;
          const isLast = index === pathnames.length - 1;

          return (
            <li key={to}>
              <span style={{ margin: '0 8px' }}>/</span>
              {isLast ? (
                <span aria-current="page" style={{ fontWeight: 'bold' }}>
                  {decodeURIComponent(value)}
                </span>
              ) : (
                <Link to={to}>{decodeURIComponent(value)}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
