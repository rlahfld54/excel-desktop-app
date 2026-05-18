import { useLocation, Link } from 'react-router-dom';
import { menuGroups, pageRoutes } from '../routesConfig';

function getSegmentLabel(pathnames, index, value) {
  const to = `/${pathnames.slice(0, index + 1).join('/')}`;
  const route = pageRoutes.find((item) => item.path === to);
  if (route) return route.label;

  const group = menuGroups.find((item) => item.basePath === to);
  if (group) return group.title;

  const segmentLabels = {
    project: '프로젝트',
    data: '데이터',
    backup: '백업',
    request: '요청 센터',
    settings: '설정',
    admin: '관리자',
  };

  return segmentLabels[value] ?? decodeURIComponent(value);
}

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
          const label = getSegmentLabel(pathnames, index, value);

          return (
            <li key={to}>
              <span style={{ margin: '0 8px' }}>/</span>
              {isLast ? (
                <span aria-current="page" style={{ fontWeight: 'bold' }}>
                  {label}
                </span>
              ) : (
                <Link to={to}>{label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
