import { Box, Text } from 'ink';
import { colors } from 'src/utils/colors';

export interface BreadcrumbsProps {
  breadcrumbs: string[];
}

export const BreadCrumbs = ({ breadcrumbs }: BreadcrumbsProps) => {
  return (
    <Box borderStyle="round" borderColor="gray" paddingX={1} marginTop={1}>
      <Text>{colors.bold(breadcrumbs.join(colors.muted(' > ')))}</Text>
    </Box>
  );
};
