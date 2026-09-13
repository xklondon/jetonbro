export const EIGHT_BALL_ANSWERS = [
  'It is certain',
  'It is decidedly so',
  'Without a doubt',
  'Yes definitely',
  'You may rely on it',
  'As I see it, yes',
  'Most likely',
  'Outlook good',
  'Yes',
  'Signs point to yes',
  'Reply hazy, try again',
  'Ask again later',
  'Better not tell you now',
  'Cannot predict now',
  'Concentrate and ask again',
  "Don't count on it",
  'My reply is no',
  'My sources say no',
  'Outlook not so good',
  'Very doubtful',
] as const;

export function pickAnswer(
  answers: readonly string[] = EIGHT_BALL_ANSWERS,
  random: () => number = Math.random,
): string {
  const index = Math.min(answers.length - 1, Math.max(0, Math.floor(random() * answers.length)));
  return answers[index] ?? answers[0]!;
}
