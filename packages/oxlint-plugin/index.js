/**
 * Project-specific oxlint rules (JS plugin, alpha API).
 * Registered in .oxlintrc.json under the `supa` namespace.
 */

const CONFIG_FILE = /[\\/]app[\\/]src[\\/]lib[\\/]config\.ts$/;

const noImportMetaEnvOutsideConfig = {
  meta: {
    type: "problem",
    docs: { description: "Read environment variables only in app/src/lib/config.ts" },
    messages: {
      forbidden:
        "Do not read `import.meta.env` here. Add the variable to app/src/lib/config.ts and use `config`.",
    },
    schema: [],
  },
  create(context) {
    if (CONFIG_FILE.test(context.filename)) return {};

    return {
      MemberExpression(node) {
        const { object, property } = node;
        if (
          object.type === "MetaProperty" &&
          object.meta.name === "import" &&
          object.property.name === "meta" &&
          !node.computed &&
          property.name === "env"
        ) {
          context.report({ node, messageId: "forbidden" });
        }
      },
    };
  },
};

export default {
  meta: { name: "supa" },
  rules: {
    "no-import-meta-env-outside-config": noImportMetaEnvOutsideConfig,
  },
};
