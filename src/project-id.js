export function projectId(project) {
  return project.slug || project.githubUrl.split('/').filter(Boolean).at(-1);
}
