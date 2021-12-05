const init = () => {
    console.log("running");
};

if (!process.env.JEST_WORKER_ID) {
    init();
}
