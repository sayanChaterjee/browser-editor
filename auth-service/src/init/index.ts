import { connectKafka } from '../config/kafka';

export default async () => {
  await connectKafka();
};