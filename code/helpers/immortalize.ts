import { TurboFactory, ArweaveSigner } from '@ardrive/turbo-sdk/web';

const immortalize = async (signer: ArweaveSigner, file: Uint8Array) => {
    const turbo = TurboFactory.authenticated({ signer });

    // prep file for upload
    const filePath = path.join(__dirname, './my-image.png');
    const fileSize = fs.statSync(filePath).size;

    // get the cost of uploading the file
    const [{ winc: fileSizeCost }] = await turbo.getUploadCosts({
        bytes: [fileSize],
    });

    // check if balance greater than upload cost
    if (balance < fileSizeCost) {
        const { url } = await turbo.createCheckoutSession({
            amount: fileSizeCost,
            owner: address,
            // add a promo code if you have one
        });
        // open the URL to top-up, continue when done
        open(url);
        return;
    }

    // upload the file
    try {
        const { id, owner, dataCaches, fastFinalityIndexes } = await turbo.uploadFile({
            fileStreamFactory: () => fs.createReadStream(filePath),
            fileSizeFactory: () => fileSize,
        });
    // upload complete!
        console.log('Successfully upload data item!', { id, owner, dataCaches, fastFinalityIndexes });
    } catch (error) {
        // upload failed
        console.error('Failed to upload data item!', error);
    } finally {
        const { winc: newBalance } = await turbo.getBalance();
        console.log('New balance:', newBalance);
    }

}