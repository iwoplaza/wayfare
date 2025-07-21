import { type BuildConfig, defineBuildConfig } from 'unbuild';
import typegpu from 'unplugin-typegpu/rollup';

const Config: BuildConfig[] = defineBuildConfig({
  failOnWarn: false,
  hooks: {
    'rollup:options': (_options, config) => {
      // biome-ignore lint/suspicious/noExplicitAny: plugins do be plugging
      config.plugins.push(typegpu({ exclude: /\.d\.ts$/ }) as any);
    },
  },
});

export default Config;
