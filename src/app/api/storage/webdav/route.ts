import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { WebDAVProvider } from '@/lib/storage/webdav-provider';
import { ClientLibrary } from '@/types/library';
import { SettingsLogger } from '@/lib/debug/logger';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const libraryId = searchParams.get('libraryId');
    const fileId = searchParams.get('fileId');

    if (!libraryId) {
      return NextResponse.json({ error: 'Library ID is required' }, { status: 400 });
    }

    // Mock library für WebDAV-Tests
    const mockLibrary: ClientLibrary = {
      id: libraryId,
      label: 'WebDAV Test Library',
      type: 'webdav',
      path: '/',
      isEnabled: true,
      config: {
        url: searchParams.get('url') || '',
        username: searchParams.get('username') || '',
        password: searchParams.get('password') || '',
        basePath: searchParams.get('basePath') || '/'
      }
    };

    SettingsLogger.info('WebDAV API', 'GET Request verarbeitet', {
      action,
      libraryId,
      fileId,
      config: {
        hasUrl: !!mockLibrary.config?.url,
        hasUsername: !!mockLibrary.config?.username,
        hasPassword: !!mockLibrary.config?.password,
        basePath: mockLibrary.config?.basePath
      }
    });

    const provider = new WebDAVProvider(mockLibrary);

    switch (action) {
      case 'list':
        if (!fileId) {
          return NextResponse.json({ error: 'File ID is required for list action' }, { status: 400 });
        }
        const items = await provider.listItemsById(fileId);
        return NextResponse.json(items);

      case 'get':
        if (!fileId) {
          return NextResponse.json({ error: 'File ID is required for get action' }, { status: 400 });
        }
        const item = await provider.getItemById(fileId);
        return NextResponse.json(item);

      case 'validate':
        const validation = await provider.validateConfiguration();
        return NextResponse.json(validation);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('WebDAV API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const libraryId = searchParams.get('libraryId');
    const fileId = searchParams.get('fileId');

    if (!libraryId) {
      return NextResponse.json({ error: 'Library ID is required' }, { status: 400 });
    }

    // Mock library für WebDAV-Tests
    const mockLibrary: ClientLibrary = {
      id: libraryId,
      label: 'WebDAV Test Library',
      type: 'webdav',
      path: '/',
      isEnabled: true,
      config: {
        url: searchParams.get('url') || '',
        username: searchParams.get('username') || '',
        password: searchParams.get('password') || '',
        basePath: searchParams.get('basePath') || '/'
      }
    };

    console.log('[WebDAV API] POST Request verarbeitet:', {
      action,
      libraryId,
      fileId,
      config: {
        hasUrl: !!mockLibrary.config?.url,
        hasUsername: !!mockLibrary.config?.username,
        hasPassword: !!mockLibrary.config?.password,
        basePath: mockLibrary.config?.basePath
      }
    });

    const provider = new WebDAVProvider(mockLibrary);

    switch (action) {
      case 'createFolder':
        if (!fileId) {
          return NextResponse.json({ error: 'Parent folder ID is required' }, { status: 400 });
        }
        const body = await request.json();
        const folderName = body.name;
        if (!folderName) {
          return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
        }
        const newFolder = await provider.createFolder(fileId, folderName);
        return NextResponse.json(newFolder);

      case 'upload':
        if (!fileId) {
          return NextResponse.json({ error: 'Parent folder ID is required' }, { status: 400 });
        }
        const formData = await request.formData();
        const file = formData.get('file') as File;
        if (!file) {
          return NextResponse.json({ error: 'File is required' }, { status: 400 });
        }
        const uploadedFile = await provider.uploadFile(fileId, file);
        return NextResponse.json(uploadedFile);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('WebDAV API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const libraryId = searchParams.get('libraryId');
    const fileId = searchParams.get('fileId');

    if (!libraryId || !fileId) {
      return NextResponse.json({ error: 'Library ID and File ID are required' }, { status: 400 });
    }

    // Mock library für WebDAV-Tests
    const mockLibrary: ClientLibrary = {
      id: libraryId,
      label: 'WebDAV Test Library',
      type: 'webdav',
      path: '/',
      isEnabled: true,
      config: {
        url: searchParams.get('url') || '',
        username: searchParams.get('username') || '',
        password: searchParams.get('password') || '',
        basePath: searchParams.get('basePath') || '/'
      }
    };

    console.log('[WebDAV API] DELETE Request verarbeitet:', {
      libraryId,
      fileId,
      config: {
        hasUrl: !!mockLibrary.config?.url,
        hasUsername: !!mockLibrary.config?.username,
        hasPassword: !!mockLibrary.config?.password,
        basePath: mockLibrary.config?.basePath
      }
    });

    const provider = new WebDAVProvider(mockLibrary);
    await provider.deleteItem(fileId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('WebDAV API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 