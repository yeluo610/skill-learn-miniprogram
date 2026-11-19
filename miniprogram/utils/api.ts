/**
 * 云函数调用封装
 */
type CloudFn = <T = unknown>(name: string, data?: unknown) => Promise<T>

const call: CloudFn = (name, data) =>
  new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success: (res) => resolve(res.result as any),
      fail: (err) => reject(err),
    })
  })

export const api = {
  login: (data?: { nickname?: string; avatarUrl?: string }) =>
    call<{ ok: boolean; data?: { openid: string; nickname: string; avatarUrl: string }; error?: string }>('login', data),

  getQuestions: (data: { skill: string; level: string; page?: number; pageSize?: number }) =>
    call<{ ok: boolean; data?: { list: any[]; total: number }; error?: string }>('getQuestions', data),

  submitAnswer: (data: { questionId: string; skill: string; level: string; type: string; answer: string | number }) =>
    call<{ ok: boolean; data?: any; error?: string }>('submitAnswer', data),

  generateExam: (data: { skill: string; examSetId?: number }) =>
    call<{ ok: boolean; data?: any; error?: string }>('generateExam', data),

  submitExam: (data: { examId: string; answers: Record<string, string | number> }) =>
    call<{ ok: boolean; data?: any; error?: string }>('submitExam', data),

  getProgress: (data?: { skill?: string }) =>
    call<{ ok: boolean; data?: any; error?: string }>('getProgress', data),

  wrongbook: (data: any) =>
    call<{ ok: boolean; data?: any; error?: string }>('getWrongbook', data),
}
