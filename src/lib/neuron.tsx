import {Circle, CircleProps} from '@motion-canvas/2d';
import {colors, sizes} from './theme';

export interface NeuronProps extends CircleProps {}

export function Neuron(props: NeuronProps) {
  return (
    <Circle
      width={sizes.neuronRadius * 2}
      height={sizes.neuronRadius * 2}
      fill={colors.neuronFill}
      stroke={colors.neuronStroke}
      lineWidth={sizes.neuronStrokeWidth}
      {...props}
    />
  );
}
