import projects from '../projects.json' with { type: 'json' };
import screenshots from './screenshots.json' with { type: 'json' };
import { projectId } from './project-id.js';

export const owner = {
  name: 'Nicholas Bennett',
  email: 'nicholas@nicholasbennett.work',
  links: [
    { label: 'GitHub', url: 'https://github.com/nrrb/' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/nicholasrrbennett/' },
  ],
};

export const apps = projects.map((project, index) => {
  const id = projectId(project);
  const screenshot = screenshots[id];
  return {
    ...project,
    id,
    year: project.firstCommitDate?.slice(0, 4) || null,
    initials: project.name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase(),
    theme: ['rose', 'blue', 'green'][index % 3],
    category: project.label || project.linkLabel || 'Project',
    image: screenshot?.status === 'captured' ? `/${screenshot.file}` : null,
    previewLabel: project.websiteUrl ? 'Preview unavailable' : 'No public web preview',
  };
});
