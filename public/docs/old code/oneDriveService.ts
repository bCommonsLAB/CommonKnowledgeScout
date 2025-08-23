import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
interface OneDriveFile {
  id: string;
  name: string;
  lastModifiedDateTime: string;
  size: number;
  folder?: { childCount: number };
  shared?: { scope: string };
  lastModifiedBy: {
    user: {
      displayName: string;
    };
  };
}

interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  modifiedDate: string;
  modifiedBy: string;
  size: string;
  shared: boolean;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const mapOneDriveFileToFileItem = (file: OneDriveFile): FileItem => {
  return {
    id: file.id,
    name: file.name,
    type: file.folder ? 'folder' : 'file',
    modifiedDate: new Date(file.lastModifiedDateTime).toLocaleDateString('de-DE'),
    modifiedBy: file.lastModifiedBy.user.displayName,
    size: formatFileSize(file.size),
    shared: file.shared ? true : false
  };
};

const getOneDriveFiles = async (accessToken: string, itemId?: string): Promise<FileItem[]> => {
  try {
    let url = 'https://graph.microsoft.com/v1.0/me/drive/root/children';
    if (itemId) {
      url = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/children`;
    }
    const response = await axios.get<{ value: OneDriveFile[] }>(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    return response.data.value.map(mapOneDriveFileToFileItem);
  } catch (error) {
    console.error('Error fetching OneDrive files:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return []; // Leere Liste zurückgeben, anstatt einen Fehler zu werfen
  }
};

interface PathSegment {
  id: string;
  name: string;
}

const getOneDriveFolderPath = async (accessToken: string, itemId: string): Promise<PathSegment[]> => {
  try {
    const response = await axios.get(`https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    const pathSegments: PathSegment[] = [{ id: 'root', name: 'Eigene Dateien' }];
    
    if (response.data.parentReference && response.data.parentReference.path) {
      const fullPath = response.data.parentReference.path.replace('/drive/root:', '') + '/' + response.data.name;
      const segments = fullPath.split('/').filter(segment => segment !== '');
      
      for (let i = 0; i < segments.length; i++) {
        const segmentResponse = await axios.get(`https://graph.microsoft.com/v1.0/me/drive/root:/${segments.slice(0, i + 1).join('/')}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        pathSegments.push({ id: segmentResponse.data.id, name: segmentResponse.data.name });
      }
    }
    
    return pathSegments;
  } catch (error) {
    console.error('Error fetching OneDrive folder path:', error);
    return [{ id: 'root', name: 'Eigene Dateien' }];
  }
};


export async function uploadOneDriveMarkdown(
  fileContent: string, 
  fileName: string, 
  parentFolderId: string, 
  accessToken: string
): Promise<string> {
  try {
    const url = `https://graph.microsoft.com/v1.0/me/drive/items/${parentFolderId}:/${fileName}:/content`;

    const response = await axios.put(url, fileContent, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'text/markdown'
      }
    });

    console.log('File uploaded successfully:', response.data);
    return response.data.id; // Return the ID of the uploaded file
  } catch (error) {
    console.error('Error uploading file to OneDrive:', error);
    throw error;
  }
}

export async function uploadOneDriveFile(filePath: string, fileName: string, parentFolderId: string, accessToken: string): Promise<string> {
  try {
    const fileContent = await fs.promises.readFile(filePath);
    const url = `https://graph.microsoft.com/v1.0/me/drive/items/${parentFolderId}:/${fileName}:/content`;

    const response = await axios.put(url, fileContent, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream'
      }
    });

    console.log('File uploaded successfully:', response.data);
    return response.data.id; // Return the ID of the uploaded file
  } catch (error) {
    console.error('Error uploading file to OneDrive:', error);
    throw error;
  }
}


export async function downloadOneDriveFile(fileId: string, accessToken: string, emitter?: EventEmitter): Promise<{ path: string, name: string }> {
  try {
    emitter?.emit('progress', { type: 'progress', step: 1, message: 'Überprüfe Datei' });

    const downloadDir: string = process.env.DOWNLOAD_DIR as string;
    let fileName: string;
    let filePath: string;

    // Zuerst die Dateiinformationen abrufen, um den Dateinamen zu erhalten
    const fileInfoResponse = await axios.get(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    fileName = fileInfoResponse.data.name;
    filePath = path.join(downloadDir, fileName);

    // Überprüfen, ob die Datei bereits existiert
    if (fs.existsSync(filePath)) {
      console.log('Datei existiert bereits:', filePath);
      emitter?.emit('progress', { type: 'progress', step: 2, message: 'Datei existiert bereits' });
      return { path: filePath, name: fileName };
    }

    emitter?.emit('progress', { type: 'progress', step: 2, message: 'Herunterladen' });

    const response = await axios.get(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      responseType: 'stream'
    });
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve({ path: filePath, name: fileName }));
      writer.on('error', reject);
    });
  } catch (error) {
    console.error('Error downloading OneDrive file:', error);
    throw error;
  }
}

export { getOneDriveFiles, getOneDriveFolderPath };
