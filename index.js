const glob = require("glob");
const fs = require("fs");

const asPromise = (fn) => (...args) =>
  new Promise((resolve, reject) =>
    fn.apply(
      null,
      args.concat((err, result) =>
        err ? reject(err) : resolve(result)
      )
    )
  );
const globPromise = asPromise(glob);
const read = asPromise(fs.readFile);
const write = asPromise(fs.writeFile);
const rename = asPromise(fs.rename);
const deleteFile = asPromise(fs.unlink);
const replaceScriptInport = (script) =>
  script
    .split("\n")
    .map((line) => {
      if (
        line.endsWith("/index.vue';") &&
        line.startsWith("import")
      ) {
        const newName = line
          .split("'")[1]
          .split("/")
          .slice(-2)[0];
        return line.replace("index.vue", `${newName}.vue`);
      }
      return line;
    })
    .join("\n");
const subFiles = (files) => files; //.slice(2, 8);
// options is optional
globPromise("../spa/src/**/index.vue", {})
  .then((
    //path and new file name
    files
  ) =>
    subFiles(files).map((file) => ({
      path: file,
      name: file.split("/").slice(-2)[0],
    }))
  )
  .then((
    // with index.vue content
    items
  ) =>
    Promise.all(
      items.map((item) =>
        read(item.path, "utf8").then((vueContent) => ({
          ...item,
          vueContent,
        }))
      )
    )
  )
  .then((
    items //if index.vue has script, i18n ...
  ) =>
    items.map((item) => ({
      ...item,
      files: {
        "index.vue": true,
        "script.js": item.vueContent.includes("script.js"),
        "i18n.txt": item.vueContent.includes("i18n.txt"),
        "template.html": item.vueContent.includes(
          "template.html"
        ),
        "style.scss": item.vueContent.includes(
          "style.scss"
        ),
      },
    }))
  )
  .then((
    items //with script content (if has script)
  ) =>
    Promise.all(
      items.map((item) =>
        !item.files["script.js"]
          ? item
          : read(
              item.path.replace("/index.vue", "/script.js"),
              "utf8"
            ).then((script) => ({ ...item, script }))
      )
    )
  )
  .then((
    items //with template content (if has template)
  ) =>
    Promise.all(
      items.map((item) =>
        !item.files["template.html"]
          ? item
          : read(
              item.path.replace(
                "/index.vue",
                "/template.html"
              ),
              "utf8"
            ).then((template) => ({ ...item, template }))
      )
    )
  )
  .then((
    items //rename script inport
  ) =>
    items.map((item) => {
      if (!item.script) {
        return item;
      }
      item.script = replaceScriptInport(item.script);
      return item;
    })
  )
  .then((
    items //rename names in index.vue
  ) =>
    items.map((item) => {
      item.vueContent = item.vueContent
        .replace("template.html", `${item.name}.html`)
        .replace("i18n.txt", `${item.name}.txt`)
        .replace("script.js", `${item.name}.js`)
        .replace("style.scss", `${item.name}.scss`);
      return item;
    })
  )
  .then((
    items //include template.html in vue file
  ) =>
    items.map((item) => {
      return item;
    })
  )
  .then((
    items //add template to vue file
  ) =>
    Promise.all(
      items.map((item) => {
        if (!item.template) {
          return item;
        }
        item.vueContent =
          item.vueContent
            .split("\n")
            .filter((line) => !line.startsWith("<template"))
            .join("\n") +
          "\n<template>\n" +
          item.template +
          "\n</template>";
        return item;
      })
    )
  )
  .then((
    items // write files
  ) =>
    Promise.all(
      items.map((item) =>
        Promise.all(
          [
            [item.vueContent, "index.vue"],
            [item.script, "script.js"],
            [item.template, "template.html"],
          ].map(
            ([content, name]) =>
              content &&
              write(
                item.path.replace("index.vue", name),
                content,
                "utf8"
              )
          )
        ).then(() => item)
      )
    )
  )
  .then((
    items // rename files
  ) =>
    Promise.all(
      items.map((item) =>
        Promise.all(
          Object.entries(item.files).map(
            ([key, shouldRename]) =>
              shouldRename &&
              key !== "template.html" &&
              rename(
                item.path.replace("index.vue", key),
                item.path.replace(
                  "index.vue",
                  item.name + "." + key.split(".")[1]
                )
              )
          )
        )
      )
    ).then(() => items)
  )
  .then((
    items // remove template.html
  ) =>
    Promise.all(
      items.map(
        (item) =>
          item.template &&
          deleteFile(
            item.path.replace("index.vue", "template.html")
          )
      )
    ).then(() => items)
  )
  .then(() => globPromise("../tests/**/*spec.js", {}))
  .then((files) =>
    Promise.all(
      files
        .concat([
          "../spa/src/main.js",
          "../spa/src/router.js",
        ])
        .map((file) =>
          read(file, "utf8").then((script) =>
            write(file, replaceScriptInport(script), "utf8")
          )
        )
    )
  )
  // last one
  .then((items) => {
    console.log(items);
  });
