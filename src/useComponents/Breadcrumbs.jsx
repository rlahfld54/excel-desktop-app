import { Link, useLocation } from 'react-router-dom';
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
  const pathnames = location.pathname.split('/').filter(Boolean);

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <li>
          <Link className="hover:text-accent-700 dark:hover:text-accent-300" to="/">
            홈
          </Link>
        </li>
        {pathnames.map((value, index) => {
          const to = `/${pathnames.slice(0, index + 1).join('/')}`;
          const isLast = index === pathnames.length - 1;
          const label = getSegmentLabel(pathnames, index, value);

          return (
            <li key={to} className="flex items-center gap-2">
              <span aria-hidden="true">/</span>
              {isLast ? (
                <span aria-current="page" className="font-semibold text-gray-800 dark:text-gray-100">
                  {label}
                </span>
              ) : (
                <Link className="hover:text-accent-700 dark:hover:text-accent-300" to={to}>
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
