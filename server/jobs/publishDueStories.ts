import { publishDueStories } from '../services/stories/scheduledStoryService.js';

const isDirectRun = process.argv[1]?.includes('publishDueStories');

if (isDirectRun) {
  publishDueStories()
    .then((r) => {
      console.log(JSON.stringify(r, null, 2));
      process.exit(r.failed > 0 ? 1 : 0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

export { publishDueStories };
