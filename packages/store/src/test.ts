import { TallyStore } from './utils/file';

const tallyStore = TallyStore.create();

const convos = await tallyStore.conversations();

// const convo = await convos.at(0)?.read();

// console.log(convo);

const runs = await convos.at(0)?.runs();

const run = await runs?.at(0)?.read();

run?.evalSummaries.forEach(({ aggregations: { percentiles } }) =>
  console.log({
    percentiles,
  }),
);
