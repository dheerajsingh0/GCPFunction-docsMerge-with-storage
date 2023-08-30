## Google Cloud Function for File Merging to PDF

### Overview

This repository contains a Google Cloud Function designed to merge various file types (e.g., PDFs, Excel files, images) from a specified source in Google Cloud Storage. After processing and merging these files into a single PDF, the function updates the database with the relevant details and subsequently saves the merged PDF back into the designated Google Cloud Storage source.

### Features

1. **Versatility in File Types**: Can process a variety of file formats including PDFs, Excel files, and images.
2. **File Merging**: Seamlessly merges multiple files into a single PDF.
3. **Database Update**: Updates the database with details of the merged PDF.
4. **Storage Integration**: Reads from and saves back to Google Cloud Storage.

### Prerequisites

1. **Google Cloud SDK**: Ensure you've [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed and initialized.
2. **Proper IAM permissions**: Your service account or user must have adequate permissions to read/write from/to Google Cloud Storage and the necessary permissions for the target database.

### Setup

1. **Clone the Repository**: 

   ```bash
   git clone https://github.com/your_username/repository_name.git
   ```

2. **Navigate to the Directory**:

   ```bash
   cd repository_name
   ```

3. **Deploy the Function**:

   Replace the placeholders with your values:

   ```bash
   gcloud functions deploy YOUR_FUNCTION_NAME --runtime YOUR_RUNTIME --trigger-resource YOUR_TRIGGER_BUCKET --trigger-event google.storage.object.finalize
   ```

### Configuration

Ensure that you've set up environment variables or configuration files that point to the correct Google Cloud Storage source and the target database.

### Usage

Once deployed and properly configured, the function will automatically trigger upon the arrival of new files in the specified Google Cloud Storage source. The function will then process these files, merge them, update the database, and save the final merged PDF.

### Contributions

Contributions, improvements, and feature requests are welcome! Please ensure that you adhere to the code style and guidelines.

### License

This project is licensed under the MIT License - see the `LICENSE.md` file for details.

### Contact

For further questions, reach out to the repository owner or raise an issue.

---

Happy Merging! 🚀
