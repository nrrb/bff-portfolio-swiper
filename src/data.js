import content from '../content.json' with { type: 'json' };
import { projectId } from './project-id.js';

export const { site, owner, copy } = content;

export const apps = content.projects.map((project, index) => {
  const id = projectId(project);
  return {
    ...project,
    id,
    year: project.firstCommitDate?.slice(0, 4) || null,
    initials: project.name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase(),
    theme: ['rose', 'blue', 'green'][index % 3],
    category: project.label || project.linkLabel || copy.card.category,
    previewLabel: project.websiteUrl ? copy.card.previewUnavailable : copy.card.noPreview,
  };
});
